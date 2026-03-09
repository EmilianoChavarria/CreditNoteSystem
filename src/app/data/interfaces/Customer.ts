import { User } from "./User"

// export interface Customer {
//   id: number
//   customerNumber: number
//   customerName: string
//   area: string
//   salesEngineerId: number
//   salesManagerId: number
//   financeManagerId: number
//   marketingManagerId: number
//   customerServiceManagerId: number
//   isActive: boolean
//   createdAt: string
//   updatedAt: string
//   deletedAt: string
//   sales_engineer: User
//   sales_manager: User
//   finance_manager: User
//   marketing_manager: User
//   customer_service_manager: User
// }

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
  idCustomer: number;
  idClient: number;
  area: string;
  salesEngineerId: number;
  salesManagerId: number;
  financeManagerId: number;
  marketingManagerId: number;
  customerServiceManagerId: number;
  salesEngineer: Manager;
  salesManager: Manager;
  financeManager: Manager;
  marketingManager: Manager;
  customerServiceManager: Manager;
}

export interface Manager {
  id: number
  fullName: string
}


