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

  // Clone request to add withCredentials: true if it is an API request
  let interceptedReq = req;
  if (req.url.startsWith(environment.apiUrl)) {
    interceptedReq = req.clone({
      withCredentials: true
    });
  }

  return next(interceptedReq).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Clear client-side authentication status cookies
        document.cookie = 'isAuthenticated=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
