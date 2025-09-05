'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  UserCheck,
  Users
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

interface User {
  id: number
  name: string
  email: string
  phone: string
  avatar: string
  status: 'active' | 'inactive' | 'pending'
  role: 'admin' | 'user' | 'editor'
  lastActive: string
  joinedAt: string
}

const sampleUsers: User[] = [
  {
    id: 1,
    name: 'Ana Silva',
    email: 'ana.silva@exemplo.com',
    phone: '+55 (11) 99999-9999',
    avatar: '/api/placeholder/48/48',
    status: 'active',
    role: 'admin',
    lastActive: '2 min atrás',
    joinedAt: '2024-01-15'
  },
  {
    id: 2,
    name: 'Carlos Santos',
    email: 'carlos.santos@exemplo.com',
    phone: '+55 (21) 88888-8888',
    avatar: '/api/placeholder/48/48',
    status: 'active',
    role: 'user',
    lastActive: '1 hora atrás',
    joinedAt: '2024-02-10'
  },
  {
    id: 3,
    name: 'Maria Oliveira',
    email: 'maria.oliveira@exemplo.com',
    phone: '+55 (31) 77777-7777',
    avatar: '/api/placeholder/48/48',
    status: 'inactive',
    role: 'editor',
    lastActive: '3 dias atrás',
    joinedAt: '2024-03-05'
  },
  {
    id: 4,
    name: 'João Pereira',
    email: 'joao.pereira@exemplo.com',
    phone: '+55 (41) 66666-6666',
    avatar: '/api/placeholder/48/48',
    status: 'pending',
    role: 'user',
    lastActive: 'Nunca',
    joinedAt: '2024-04-20'
  },
  {
    id: 5,
    name: 'Fernanda Costa',
    email: 'fernanda.costa@exemplo.com',
    phone: '+55 (51) 55555-5555',
    avatar: '/api/placeholder/48/48',
    status: 'active',
    role: 'editor',
    lastActive: '30 min atrás',
    joinedAt: '2024-05-12'
  }
]

export default function UsersPage() {
  const [users] = useState<User[]>(sampleUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all')

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'active': return 'border-green-500 text-green-700 bg-green-50'
      case 'inactive': return 'border-gray-500 text-gray-700 bg-gray-50'
      case 'pending': return 'border-yellow-500 text-yellow-700 bg-yellow-50'
      default: return 'border-gray-500 text-gray-700 bg-gray-50'
    }
  }

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'border-red-500 text-red-700 bg-red-50'
      case 'editor': return 'border-blue-500 text-blue-700 bg-blue-50'
      case 'user': return 'border-gray-500 text-gray-700 bg-gray-50'
      default: return 'border-gray-500 text-gray-700 bg-gray-50'
    }
  }

  const getStatusText = (status: User['status']) => {
    switch (status) {
      case 'active': return 'Ativo'
      case 'inactive': return 'Inativo'
      case 'pending': return 'Pendente'
      default: return status
    }
  }

  const getRoleText = (role: User['role']) => {
    switch (role) {
      case 'admin': return 'Administrador'
      case 'editor': return 'Editor'
      case 'user': return 'Usuário'
      default: return role
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || user.status === selectedFilter
    
    return matchesSearch && matchesFilter
  })

  const statusCounts = {
    all: users.length,
    active: users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status === 'inactive').length,
    pending: users.filter(u => u.status === 'pending').length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Gerenciamento de Usuários
              </h1>
              <p className="text-gray-600 mt-2">
                {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
              </p>
            </div>
            <Button className="bg-gradient-to-r from-blue-600 to-purple-600">
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </motion.div>

        {/* Filters and Search */}
        <motion.div 
          className="mb-6 space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Todos' },
              { key: 'active', label: 'Ativos' },
              { key: 'inactive', label: 'Inativos' },
              { key: 'pending', label: 'Pendentes' }
            ].map(filter => (
              <Button
                key={filter.key}
                variant={selectedFilter === filter.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFilter(filter.key as any)}
                className="relative"
              >
                {filter.label}
                <Badge 
                  variant="secondary" 
                  className="ml-2 text-xs"
                >
                  {statusCounts[filter.key as keyof typeof statusCounts]}
                </Badge>
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.id}
                variants={fadeInUp}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ delay: index * 0.1 }}
                layout
              >
                <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{user.name}</CardTitle>
                          <CardDescription>
                            Membro desde {new Date(user.joinedAt).toLocaleDateString('pt-BR')}
                          </CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="h-4 w-4" />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="h-4 w-4" />
                      {user.phone}
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-2">
                        <Badge className={`${getStatusColor(user.status)} border`}>
                          {getStatusText(user.status)}
                        </Badge>
                        <Badge className={`${getRoleColor(user.role)} border`}>
                          {getRoleText(user.role)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <UserCheck className="h-3 w-3" />
                        {user.lastActive}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Editar
                      </Button>
                      <Button 
                        variant={user.status === 'active' ? 'destructive' : 'default'} 
                        size="sm"
                        className="flex-1"
                      >
                        {user.status === 'active' ? 'Desativar' : 'Ativar'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {filteredUsers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum usuário encontrado
            </h3>
            <p className="text-gray-500 mb-4">
              Tente ajustar os filtros ou termo de busca
            </p>
            <Button onClick={() => {
              setSearchQuery('')
              setSelectedFilter('all')
            }}>
              Limpar filtros
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}