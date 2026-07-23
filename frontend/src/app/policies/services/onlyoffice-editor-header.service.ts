import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class OnlyOfficeEditorHeaderService {
  readonly title = signal('');
  readonly versionName = signal('');
  readonly publishRequest = signal(0);
  readonly publishing = signal(false);

  setTitle(title: string): void {
    this.title.set(title.trim());
  }

  setVersionName(versionName: string): void {
    this.versionName.set(versionName);
  }

  requestPublish(): void {
    this.publishRequest.update(value => value + 1);
  }

  setPublishing(publishing: boolean): void {
    this.publishing.set(publishing);
  }

  clear(): void {
    this.title.set('');
    this.versionName.set('');
    this.publishRequest.set(0);
    this.publishing.set(false);
  }
}
