import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

export const prerender = false;
export const ssr = true;

export function load() {
  // Auth check happens on client-side; SSR will pass through
  if (browser) {
    const token = localStorage.getItem('token');
    if (!token) {
      throw redirect(302, '/login');
    }
  }
  return {};
}
