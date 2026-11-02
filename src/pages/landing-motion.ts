import { Clapperboard, FileSearch, MessageCircle, UsersRound, type LucideIcon } from 'lucide-react'

export type SceneKind = 'video' | 'analise' | 'clientes' | 'mensagens'

export const sceneTabs: { kind: SceneKind; label: string; icon: LucideIcon }[] = [
  { kind: 'video', label: 'Vídeos', icon: Clapperboard },
  { kind: 'analise', label: 'Análises', icon: FileSearch },
  { kind: 'clientes', label: 'Acompanhamento', icon: UsersRound },
  { kind: 'mensagens', label: 'Mensagens', icon: MessageCircle },
]

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
