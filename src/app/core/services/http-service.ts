import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestOptions {
  params?: { [key: string]: string | number | boolean };
  headers?: { [key: string]: string };
}

@Injectable({
  providedIn: 'root'
})
export class HttpService {
  // private readonly baseURL = 'http://192.168.2.29:8000/api';
  private readonly baseURL = 'http://192.168.2.52:8000/api';
  // private readonly baseURL = 'http://127.0.0.1:8000/api';
  // private readonly baseURL = 'http://localhost:8000/api';
  private readonly defaultTimeout = 10000;
  private readonly defaultHeaders = {
    'Content-Type': 'application/json'
  };

  constructor(private http: HttpClient) { }

  /**
   * Método genérico para realizar peticiones HTTP
   * @param method - Método HTTP (GET, POST, PUT, DELETE, PATCH)
   * @param endpoint - Endpoint relativo (ej: '/users', '/auth/login')
   * @param data - Datos a enviar en el body (opcional)
   * @param options - Opciones adicionales como params y headers (opcional)
   * @returns Observable con la respuesta tipada
   */
  request<T>(
    method: HttpMethod,
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Observable<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const httpOptions = this.buildHttpOptions(options);

    let request$: Observable<ApiResponse<T>>;

    switch (method) {
      case 'GET':
        request$ = this.http.get<ApiResponse<T>>(url, httpOptions);
        break;
      case 'POST':
        request$ = this.http.post<ApiResponse<T>>(url, data, httpOptions);
        break;
      case 'PUT':
        request$ = this.http.put<ApiResponse<T>>(url, data, httpOptions);
        break;
      case 'DELETE':
        request$ = this.http.delete<ApiResponse<T>>(url, httpOptions);
        break;
      case 'PATCH':
        request$ = this.http.patch<ApiResponse<T>>(url, data, httpOptions);
        break;
      default:
        throw new Error(`Método HTTP no soportado: ${method}`);
    }

    return request$.pipe(timeout(this.defaultTimeout));
  }

  /**
   * Construye la URL completa combinando baseURL con el endpoint
   */
  private buildUrl(endpoint: string): string {
    // Si el endpoint ya es una URL completa, la retorna tal cual
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    // Asegura que el endpoint comience con /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseURL}${normalizedEndpoint}`;
  }

  /**
   * Método para construir las opciones HTTP
   */
  private buildHttpOptions(options?: RequestOptions): {
    headers?: HttpHeaders;
    params?: HttpParams;
    withCredentials?: boolean;
  } {
    const httpOptions: any = {
      withCredentials: true // Permite enviar y recibir cookies
    };

    // Combina headers por defecto con headers personalizados
    const mergedHeaders = { ...this.defaultHeaders, ...options?.headers };
    httpOptions.headers = new HttpHeaders(mergedHeaders);

    if (options?.params) {
      let httpParams = new HttpParams();
      Object.keys(options.params).forEach(key => {
        httpParams = httpParams.set(key, String(options.params![key]));
      });
      httpOptions.params = httpParams;
    }

    return httpOptions;
  }

  // Métodos helper para mayor comodidad
  get<T>(url: string, options?: RequestOptions): Observable<ApiResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  post<T>(url: string, data: any, options?: RequestOptions): Observable<ApiResponse<T>> {
    return this.request<T>('POST', url, data, options);
  }

  put<T>(url: string, data: any, options?: RequestOptions): Observable<ApiResponse<T>> {
    return this.request<T>('PUT', url, data, options);
  }

  delete<T>(url: string, options?: RequestOptions): Observable<ApiResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }

  patch<T>(url: string, data: any, options?: RequestOptions): Observable<ApiResponse<T>> {
    return this.request<T>('PATCH', url, data, options);
  }
}
