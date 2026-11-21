'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useLocale } from '@/features/i18n/locale-context';
import type { MessageKey } from '@/lib/i18n';

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active' | 'ended';

const DEFAULT_ICE: IceServerConfig[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
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
export function useOrderCall({ orderId, disabled }: { orderId: string; disabled?: boolean }) {
  const { t } = useLocale();
  const [status, setStatus] = useState<CallStatus>('idle');
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // The remote audio sink lives here rather than in the DOM: the element is only ever
  // touched from event handlers, and returning a ref would leak it into render.
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string | null>(null);
  const iceServersRef = useRef<IceServerConfig[]>(DEFAULT_ICE);
  // Candidates can arrive before the remote description is set; hold them until then.
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const ackError = useCallback(
    (ack: CallAck, fallback: MessageKey) => {
      const key = ack.code ? ACK_ERROR_KEYS[ack.code] : undefined;
      return t(key ?? fallback);
    },
    [t],
  );

  const remoteAudio = useCallback(() => {
    remoteAudioRef.current ??= new Audio();
    remoteAudioRef.current.autoplay = true;
    return remoteAudioRef.current;
  }, []);

  const teardown = useCallback((next: CallStatus) => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    callIdRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    setIncoming(null);
    setMuted(false);
    setSeconds(0);
    setStatus(next);
  }, []);

  const createPeer = useCallback(async (callId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    const peer = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peerRef.current = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (event) => {
      const [remote] = event.streams;
      if (remote) {
        const audio = remoteAudio();
        audio.srcObject = remote;
        void audio.play().catch(() => undefined);
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal(orderId, callId, { candidate: event.candidate.toJSON() });
      }
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        setStatus('active');
      }
      if (peer.connectionState === 'failed') {
        setError(t('order.call.errors.connectionFailed'));
        teardown('ended');
      }
    };

    return peer;
  }, [orderId, remoteAudio, t, teardown]);

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
    const ack = await inviteToCall(orderId);
    if (!ack.ok || !ack.callId) {
      setError(ackError(ack, 'order.call.errors.startFailed'));
      return;
    }
    callIdRef.current = ack.callId;
    iceServersRef.current = ack.iceServers?.length ? ack.iceServers : DEFAULT_ICE;
    setStatus('calling');
  }, [ackError, disabled, orderId, status]);

  const accept = useCallback(async () => {
    const pending = incoming;
    if (!pending) return;
    setError('');
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
  }, [ackError, createPeer, incoming, mediaError, teardown]);

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
          const offer = await peer.createOffer();
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
              await peer.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidatesRef.current = [];

            if (payload.description.type === 'offer') {
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              sendCallSignal(orderId, payload.callId, { description: answer });
            }
            return;
          }

          if (payload.candidate) {
            if (peer.remoteDescription) {
              await peer.addIceCandidate(new RTCIceCandidate(payload.candidate));
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
