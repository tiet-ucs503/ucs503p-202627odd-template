/** True when the page address asks for the camera test readout: ...?attentionDebug=1 */
export const attentionDebugRequested = () => new URLSearchParams(window.location.search).has('attentionDebug');
