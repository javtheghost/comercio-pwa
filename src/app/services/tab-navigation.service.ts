import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TabNavigationService {
  private tabChangeSubject = new Subject<string>();
  tabChange$ = this.tabChangeSubject.asObservable();

  navigateToTab(path: string) {
    this.tabChangeSubject.next(path);
  }
}
