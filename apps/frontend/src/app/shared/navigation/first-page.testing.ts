import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { type RouterTestingHarness } from '@angular/router/testing';

export async function openFirstPage(harness: RouterTestingHarness, url: string): Promise<void> {
  TestBed.inject(Location).replaceState(url);
  await harness.navigateByUrl(url);
}
