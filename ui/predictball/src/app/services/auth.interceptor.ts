import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const document = inject(DOCUMENT);

  let interceptedReq = req;
  if (req.url.startsWith(environment.apiUrl)) {
    let headers = req.headers;
    if (typeof localStorage !== 'undefined') {
      const adminToken = localStorage.getItem('adminToken');
      if (adminToken) {
        headers = headers.set('X-Admin-Token', adminToken);
      }
    }
    interceptedReq = req.clone({
      withCredentials: true,
      headers: headers
    });
  }

  return next(interceptedReq).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        if (!req.url.includes('/admin/')) {
          // Clear client-side authentication status cookies for regular user routes
          document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
          document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
