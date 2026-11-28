'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  acceptCall,
  declineCall,
  endCall,
  inviteToCall,
  sendCallSignal,
  subscribeToCalls,
  type CallAck,
  type CallSignal,
  type IceServerConfig,
  type IncomingCall,
} from '@/lib/call-signaling';
import { connectSocket } from '@/lib/socket';
import { useLocale } from '@/features/i18n/locale-context';
import type { MessageKey } from '@/lib/i18n';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

const DEFAULT_ICE: IceServerConfig[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:global.stun.twilio.com:3478',
    ],
  },
];

/** Gateway ack codes → localized copy. The ack's own `error` text is English-only. */
const ACK_ERROR_KEYS: Record<string, MessageKey> = {
  CONFLICT: 'order.call.errors.inProgress',
  NOT_FOUND: 'order.call.errors.notFound',
  FORBIDDEN: 'order.call.errors.notAllowed',
  VALIDATION_ERROR: 'order.call.errors.invalidOrder',
  NO_RESPONSE: 'order.call.errors.noResponse',
};

/**
 * Voice calling for an order, so buyers and farmers never need to swap phone numbers.
 *
 * Audio is peer-to-peer WebRTC; the server only relays offers, answers, and ICE
 * candidates over the order's Socket.io room.
 */
export function useOrderCall({
  orderId,
  disabled,
  audioElementRef,
}: {
  orderId: string;
  disabled?: boolean;
  audioElementRef?: RefObject<HTMLAudioElement | null>;
}) {
  const { t } = useLocale();
  const [status, setStatus] = useState<CallStatus>('idle');
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // The remote audio sink: prefers active DOM audio element, falls back to in-memory Audio
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const iceServersRef = useRef<IceServerConfig[]>(DEFAULT_ICE);
  // Candidates can arrive before the remote description is set; hold them until then.
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Explicitly join the order room to receive order-level signaling
  useEffect(() => {
    if (disabled) return;
    const client = connectSocket();
    client.emit('join:order', orderId);
    return () => {
      client.emit('leave:order', orderId);
    };
  }, [disabled, orderId]);

  const ackError = useCallback(
    (ack: CallAck, fallback: MessageKey) => {
      const key = ack.code ? ACK_ERROR_KEYS[ack.code] : undefined;
      return t(key ?? fallback);
    },
    [t],
  );

  const remoteAudio = useCallback(() => {
    if (audioElementRef?.current) {
      return audioElementRef.current;
    }
    fallbackAudioRef.current ??= new Audio();
    fallbackAudioRef.current.autoplay = true;
    return fallbackAudioRef.current;
  }, [audioElementRef]);

  const teardown = useCallback((next: CallStatus) => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    callIdRef.current = null;
    if (audioElementRef?.current) {
      audioElementRef.current.srcObject = null;
    }
    if (fallbackAudioRef.current) {
      fallbackAudioRef.current.srcObject = null;
    }
    setIncoming(null);
    setMuted(false);
    setSeconds(0);
    setStatus(next);
  }, [audioElementRef]);

  const acquireMedia = useCallback(async () => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    localStreamRef.current = stream;
    return stream;
  }, []);

  const createPeer = useCallback(async (callId: string) => {
    const stream = await acquireMedia();

    const peer = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peerRef.current = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    // Enforce full-duplex bidirectional audio transceiver configuration
    peer.getTransceivers().forEach((transceiver) => {
      if (transceiver.receiver.track.kind === 'audio') {
        transceiver.direction = 'sendrecv';
      }
    });

    peer.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const audio = remoteAudio();
      audio.srcObject = stream;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Fallback if browser autoplay policy blocks unmuted audio
          const unlock = () => {
            void audio.play().catch(() => undefined);
            window.removeEventListener('click', unlock);
            window.removeEventListener('keydown', unlock);
          };
          window.addEventListener('click', unlock);
          window.addEventListener('keydown', unlock);
        });
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal(orderId, callId, { candidate: event.candidate.toJSON() });
      }
    };

    const updateActive = () => {
      const conn = peer.connectionState;
      const ice = peer.iceConnectionState;
      if (conn === 'connected' || ice === 'connected' || ice === 'completed') {
        setStatus('active');
      } else if (conn === 'connecting' || ice === 'checking') {
        setStatus((prev) => (prev === 'active' ? 'active' : 'connecting'));
      } else if (conn === 'failed' || ice === 'failed') {
        setError(t('order.call.errors.connectionFailed'));
        teardown('ended');
      }
    };

    peer.onconnectionstatechange = updateActive;
    peer.oniceconnectionstatechange = updateActive;

    return peer;
  }, [acquireMedia, orderId, remoteAudio, t, teardown]);

  const mediaError = useCallback(
    (cause: unknown) => {
      const name = cause instanceof Error ? cause.name : '';
      if (name === 'NotAllowedError') {
        return t('order.call.errors.micDenied');
      }
      if (name === 'NotFoundError') {
        return t('order.call.errors.micMissing');
      }
      return t('order.call.errors.startFailed');
    },
    [t],
  );

  const start = useCallback(async () => {
    if (disabled || status !== 'idle') return;
    setError('');

    try {
      // Prime remote audio element & pre-warm mic hardware within user click gesture
      const audio = remoteAudio();
      void audio.play().catch(() => undefined);
      await acquireMedia();
    } catch (cause) {
      setError(mediaError(cause));
      return;
    }

    const ack = await inviteToCall(orderId);
    if (!ack.ok || !ack.callId) {
      setError(ackError(ack, 'order.call.errors.startFailed'));
      teardown('idle');
      return;
    }
    callIdRef.current = ack.callId;
    iceServersRef.current = ack.iceServers?.length ? ack.iceServers : DEFAULT_ICE;
    setStatus('calling');
  }, [ackError, acquireMedia, disabled, mediaError, orderId, remoteAudio, status, teardown]);

  const accept = useCallback(async (customIncoming?: IncomingCall) => {
    const pending = customIncoming ?? incoming;
    if (!pending) return;
    setError('');

    try {
      // Prime audio element & pre-warm mic within click gesture
      const audio = remoteAudio();
      void audio.play().catch(() => undefined);
      await acquireMedia();
    } catch (cause) {
      setError(mediaError(cause));
      return;
    }

    const ack = await acceptCall(pending.orderId, pending.callId);
    if (!ack.ok) {
      setError(ackError(ack, 'order.call.errors.joinFailed'));
      teardown('idle');
      return;
    }
    iceServersRef.current = ack.iceServers?.length ? ack.iceServers : DEFAULT_ICE;
    callIdRef.current = pending.callId;
    try {
      await createPeer(pending.callId);
      setIncoming(null);
      setStatus('connecting');
    } catch (cause) {
      setError(mediaError(cause));
      declineCall(pending.orderId, pending.callId);
      teardown('idle');
    }
  }, [ackError, acquireMedia, createPeer, incoming, mediaError, remoteAudio, teardown]);

  // Handle pre-accepted incoming calls forwarded from global modal banner
  useEffect(() => {
    if (disabled) return;
    let timer: number | null = null;
    try {
      const raw = sessionStorage.getItem('agriconnect_pending_call_accept');
      if (raw) {
        sessionStorage.removeItem('agriconnect_pending_call_accept');
        const parsed = JSON.parse(raw) as IncomingCall;
        if (parsed.orderId === orderId) {
          timer = window.setTimeout(() => {
            void accept(parsed);
          }, 0);
        }
      }
    } catch {
      // Ignore sessionStorage parse errors
    }
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [accept, disabled, orderId]);

  const decline = useCallback(() => {
    if (incoming) {
      declineCall(incoming.orderId, incoming.callId);
    }
    teardown('idle');
  }, [incoming, teardown]);

  const hangUp = useCallback(() => {
    if (callIdRef.current) {
      endCall(orderId, callIdRef.current);
    }
    teardown('idle');
  }, [orderId, teardown]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  }, [muted]);

  useEffect(() => {
    const unsubscribe = subscribeToCalls({
      onIncoming: (payload) => {
        if (payload.orderId !== orderId) return;
        // Already busy on this order: let the server-side single-call rule stand.
        if (peerRef.current || callIdRef.current) return;
        setIncoming(payload);
        setStatus('ringing');
      },

      // Callee picked up: the caller now owns the offer.
      onAccepted: async (payload) => {
        if (payload.orderId !== orderId || payload.callId !== callIdRef.current) return;
        try {
          const peer = await createPeer(payload.callId);
          setStatus('connecting');
          const offer = await peer.createOffer({ offerToReceiveAudio: true });
          await peer.setLocalDescription(offer);
          sendCallSignal(orderId, payload.callId, { description: offer });
        } catch (cause) {
          setError(mediaError(cause));
          hangUp();
        }
      },

      onDeclined: (payload) => {
        if (payload.orderId !== orderId) return;
        setError(t('order.call.errors.declined'));
        teardown('idle');
      },

      onEnded: (payload) => {
        if (payload.orderId !== orderId) return;
        teardown('idle');
      },

      onSignal: async (payload: CallSignal) => {
        if (payload.orderId !== orderId) return;
        const peer = peerRef.current;
        if (!peer || payload.callId !== callIdRef.current) return;

        try {
          if (payload.description) {
            await peer.setRemoteDescription(new RTCSessionDescription(payload.description));

            for (const candidate of pendingCandidatesRef.current) {
              await peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
            }
            pendingCandidatesRef.current = [];

            if (payload.description.type === 'offer') {
              const answer = await peer.createAnswer({ offerToReceiveAudio: true });
              await peer.setLocalDescription(answer);
              sendCallSignal(orderId, payload.callId, { description: answer });
            }
            return;
          }

          if (payload.candidate) {
            if (peer.remoteDescription) {
              await peer.addIceCandidate(new RTCIceCandidate(payload.candidate)).catch(() => undefined);
            } else {
              pendingCandidatesRef.current.push(payload.candidate);
            }
          }
        } catch {
          setError(t('order.call.errors.negotiationFailed'));
        }
      },
    });

    return unsubscribe;
  }, [createPeer, hangUp, mediaError, orderId, t, teardown]);

  useEffect(() => {
    if (status !== 'active') return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  // Hang up if the page unmounts mid-call.
  useEffect(
    () => () => {
      peerRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return {
    status,
    incoming,
    error,
    muted,
    seconds,
    start,
    accept,
    decline,
    hangUp,
    toggleMute,
    dismissError: () => setError(''),
  };
}
