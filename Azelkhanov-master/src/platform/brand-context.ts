import { createContext, useContext } from 'react'
import { defaultBrand } from './config.ts'
export const BrandContext = createContext(defaultBrand)
export const useBrand = () => useContext(BrandContext)
