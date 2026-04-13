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
  customer?: CustomerLocal;
}

export interface CustomerLocal {
  idCustomer?: number;
  idCliente?: string;
  area: string;
  salesEngineerId: string;
  salesManagerId: string;
  financeManagerId: string;
  marketingManagerId: string;
  customerServiceManagerId: string;
  salesEngineer?: Manager;
  salesManager?: Manager;
  financeManager?: Manager;
  marketingManager?: Manager;
  customerServiceManager?: Manager;
}

export interface Manager {
  id: number
  fullName: string
}


