export interface Customer {
  idCliente: string;
  estatus: string;
  rfc: string;
  razonSocial: string;
  RegimenCapital: string;
  direccion: string;
  contrasena: string;
  contrasena56: any;
  correos: string;
  correosPagos: string;
  enviarCorreos: string;
  ResidenciaFiscal: string;
  NumRegIdTrib: string;
  UsoCFDI: string;
  RegimenFiscal: string;
  MetodoPago: string;
  FormaPago: string;
  condicionesPago: string;
  moneda: string;
  idUsuarioCc: string;
  ulActualizacionCc: string;
  clienteExt?: CustomerLocal;
}

export interface CustomerLocal {
  idCustomer?: number;
  idCliente?: string;
  area: string | null;
  salesEngineerId?: Manager | null;
  salesManagerId?: Manager | null;
  financeManagerId?: Manager | null;
  marketingManagerId?: Manager | null;
  customerServiceManagerId?: Manager | null;
  distributor?: Manager | null;
}

export interface Manager {
  id: number;
  fullName: string;
  role?: { roleName: string };
}

export interface CustomerLocalPayload {
  idClient?: string;
  area: string;
  salesEngineerId: string;
  salesManagerId: string;
  financeManagerId: string;
  marketingManagerId: string;
  customerServiceManagerId: string;
}


