// See https://kit.svelte.dev/docs/types#app
import type { User } from '$lib/api/types';

declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    interface PageData {
      user?: User | null;
    }
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
