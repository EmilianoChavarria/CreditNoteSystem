export interface ApiResponse<T> {
  codeStatus: number
  success: boolean
  message?: string
  data: T | null
  errors: any
  timestamp: string
}

