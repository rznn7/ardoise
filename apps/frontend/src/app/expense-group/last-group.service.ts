import { Injectable } from '@angular/core';

export const LAST_GROUP_STORAGE_KEY = 'ardoise.lastGroup';

function readStoredGroupId(): number | null {
  try {
    const id = Number(localStorage.getItem(LAST_GROUP_STORAGE_KEY));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

function writeStoredGroupId(groupId: number): void {
  try {
    localStorage.setItem(LAST_GROUP_STORAGE_KEY, String(groupId));
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class LastGroupService {
  private launchRedirectUsed = false;

  remember(groupId: number): void {
    this.launchRedirectUsed = true;
    writeStoredGroupId(groupId);
  }

  skipLaunchRedirect(): void {
    this.launchRedirectUsed = true;
  }

  takeLaunchRedirect(): number | null {
    if (this.launchRedirectUsed) return null;
    this.launchRedirectUsed = true;
    return readStoredGroupId();
  }
}
