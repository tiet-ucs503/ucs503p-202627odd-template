export const getCookieOptions = () => ({
  httpOnly: true,
  // sameSite='none' and secure=true are REQUIRED for the cookie to be sent 
  // from a cross-origin site (leetcode.com) to our backend API.
  sameSite: 'none',
  secure: true,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

export const getClearCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'none',
  secure: true,
  path: '/',
});
