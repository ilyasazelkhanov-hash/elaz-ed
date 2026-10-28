import { createContext, useContext, type ReactNode } from 'react'
import { academyRequest, academyDemoRequest } from './academy'

const LearningScope = createContext(false)
export function LearningProvider({ demo, children }: { demo: boolean; children: ReactNode }) {
  return <LearningScope.Provider value={demo}>{children}</LearningScope.Provider>
}
export const useLearningDemo = () => useContext(LearningScope)
export const useLearningRequest = () => useLearningDemo() ? academyDemoRequest : academyRequest
