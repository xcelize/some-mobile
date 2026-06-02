import {inject} from '@angular/core';
import {HttpErrorResponse, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {Router} from '@angular/router';
import {catchError, from, switchMap, throwError} from 'rxjs';
import {environment} from '../../../environments/environment';
import {AuthService} from '../service/auth.service';

const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isBackendRequest(request) || isAuthRequest(request)) {
    return next(request);
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  return from(authService.getToken()).pipe(
    switchMap((token) => next(withBearerToken(request, token))),
    catchError((error: unknown) => {
      if (!isAuthenticationError(error)) {
        return throwError(() => error);
      }

      return from(authService.refreshSession()).pipe(
        catchError((refreshError: unknown) => {
          void router.navigate(['/setup']);
          return throwError(() => refreshError);
        }),
        switchMap((token) => next(withBearerToken(request, token)))
      );
    })
  );
};

function isBackendRequest(request: HttpRequest<unknown>): boolean {
  return request.url.startsWith(environment.apiBaseUrl);
}

function isAuthRequest(request: HttpRequest<unknown>): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => request.url.includes(endpoint));
}

function isAuthenticationError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403);
}

function withBearerToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token?.trim()) {
    return request;
  }

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}
