// Remembers, on this device only, whether a student chose to use the camera.
// It is a convenience so they are not asked before every mission; it is kept
// per account so a different student on the same computer is asked again.

export type CameraChoice = 'enabled' | 'declined';

const key = (userId: number) => `mathverse_camera_choice_${userId}`;

export function getCameraChoice(userId: number): CameraChoice | null {
  try {
    const value = localStorage.getItem(key(userId));
    return value === 'enabled' || value === 'declined' ? value : null;
  } catch {
    return null; // storage unavailable: just ask again next time
  }
}

export function setCameraChoice(userId: number, choice: CameraChoice): void {
  try {
    localStorage.setItem(key(userId), choice);
  } catch {
    /* storage unavailable: the choice lasts for this mission only */
  }
}
