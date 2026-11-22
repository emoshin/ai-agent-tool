import type { BackendAuthSession, BackendUserProfile } from '../types/auth';

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string; error?: string };
    if (data.message) return data.message;
    if (data.error) return `${data.error} (${response.status})`;
  } catch {
    const text = await response.text().catch(() => '');
    if (text.trim()) return text.slice(0, 180);
  }
  return `${fallback} (${response.status})`;
}

export async function loginUser(email: string, password: string): Promise<BackendAuthSession> {
  const response = await fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Login failed'));
  }

  return (await response.json()) as BackendAuthSession;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  subtitle?: string;
}): Promise<BackendAuthSession> {
  const response = await fetch('/api/users/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      password: input.password,
      subtitle: input.subtitle?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Registration failed'));
  }

  return (await response.json()) as BackendAuthSession;
}

export async function fetchCurrentUser(accessToken: string): Promise<BackendUserProfile> {
  const response = await fetch('/api/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load profile'));
  }

  return (await response.json()) as BackendUserProfile;
}

export async function updateCurrentUserProfile(
  accessToken: string,
  payload: {
    name: string;
    subtitle: string;
    avatarUrl: string;
    newPassword?: string;
  }
): Promise<BackendUserProfile> {
  const response = await fetch('/api/users/me', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update profile'));
  }

  return (await response.json()) as BackendUserProfile;
}
