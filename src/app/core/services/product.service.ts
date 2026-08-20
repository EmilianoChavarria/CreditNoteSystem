import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { PagePagination } from '../../data/interfaces/RequestService';
import { catchError, map, Observable } from 'rxjs';

export interface ProductCatalogItem {
  id: number;
  idProducto: string;
  rfc: string;
  estatus: string;
  claveProdServ: string | null;
  claveUnidad: string | null;
  unidadMedida: string;
  descripcion: string;
  valorUnitario: string;
  clasificacion: 'Rodamientos' | 'No Rodamientos' | null;
}

export type ProductClasificacion = 'Rodamientos' | 'No Rodamientos';

/** Filtro de clasificacion del catalogo: 'unclassified' = productos sin registro de clasificacion. */
export type ProductClasificacionFilter = ProductClasificacion | 'unclassified' | 'all';

export interface ProductClassification {
  id: number;
  idProducto: string;
  clasificacion: ProductClasificacion;
}

export interface ProductClassificationResult extends ProductClassification {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor(private readonly _httpService: HttpService) { }

  getProductsCatalog(perPage = 100, page = 1, search?: string, clasificacion?: ProductClasificacionFilter): Observable<PagePagination<ProductCatalogItem>> {
    const params: { per_page: number; page: number; search?: string; clasificacion?: string } = { per_page: perPage, page };
    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }
    if (clasificacion && clasificacion !== 'all') {
      params.clasificacion = clasificacion;
    }

    return this._httpService.get<PagePagination<ProductCatalogItem>>('/products/catalog', {
      params
    }).pipe(
      map((response: ApiResponse<PagePagination<ProductCatalogItem>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page ?? 1,
          last_page: payload?.last_page ?? 1,
          per_page: payload?.per_page,
          total: payload?.total,
          next_page_url: payload?.next_page_url ?? null,
          prev_page_url: payload?.prev_page_url ?? null,
        };
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  classifyProduct(idProducto: string, clasificacion: ProductClasificacion): Observable<ProductClassificationResult> {
    return this._httpService.post<ProductClassification>('/products/catalog/classify', {
      idProducto,
      clasificacion,
    }).pipe(
      map((response: ApiResponse<ProductClassification>) => {
        if (!response.data) {
          throw new Error(response.message ?? 'No se pudo guardar la clasificación.');
        }
        return { ...response.data, message: response.message ?? 'Clasificación guardada' };
      })
    );
  }
}
