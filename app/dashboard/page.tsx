'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Activity,
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  Layers,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

interface DashboardData {
  stats: {
    totalUsers: number
    totalRevenue: number
    totalOrders: number
    activeProjects: number
  }
  recentActivity: Array<{
    id: number
    type: 'user' | 'order' | 'project' | 'system'
    message: string
    timestamp: string
  }>
  projectStatus: Array<{
    id: number
    name: string
    progress: number
    status: 'on-track' | 'delayed' | 'completed'
    dueDate: string
  }>
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Simulate API call
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true)
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const mockData: DashboardData = {
        stats: {
          totalUsers: 1234,
          totalRevenue: 45678,
          totalOrders: 89,
          activeProjects: 12
        },
        recentActivity: [
          {
            id: 1,
            type: 'user',
            message: 'Novo usuário cadastrado: Maria Silva',
            timestamp: '2 min atrás'
          },
          {
            id: 2,
            type: 'order',
            message: 'Pedido #12345 foi finalizado',
            timestamp: '15 min atrás'
          },
          {
            id: 3,
            type: 'project',
            message: 'Projeto "App Mobile" atingiu 75% de conclusão',
            timestamp: '1 hora atrás'
          },
          {
            id: 4,
            type: 'system',
            message: 'Backup automático realizado com sucesso',
            timestamp: '2 horas atrás'
          }
        ],
        projectStatus: [
          {
            id: 1,
            name: 'Website Corporativo',
            progress: 85,
            status: 'on-track',
            dueDate: '2025-01-15'
          },
          {
            id: 2,
            name: 'App Mobile',
            progress: 75,
            status: 'on-track',
            dueDate: '2025-01-20'
          },
          {
            id: 3,
            name: 'Sistema CRM',
            progress: 45,
            status: 'delayed',
            dueDate: '2025-01-10'
          },
          {
            id: 4,
            name: 'E-commerce',
            progress: 100,
            status: 'completed',
            dueDate: '2025-01-01'
          }
        ]
      }

      setDashboardData(mockData)
      setIsLoading(false)
    }

    fetchDashboardData()
  }, [])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user': return Users
      case 'order': return DollarSign
      case 'project': return Layers
      default: return Activity
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'on-track': return 'bg-blue-500'
      case 'delayed': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-green-500 text-green-700 bg-green-50'
      case 'on-track': return 'border-blue-500 text-blue-700 bg-blue-50'
      case 'delayed': return 'border-red-500 text-red-700 bg-red-50'
      default: return 'border-gray-500 text-gray-700 bg-gray-50'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center min-h-screen">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"
            />
            <span className="ml-3 text-gray-600">Carregando dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!dashboardData) return null

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
                Dashboard Executivo
              </h1>
              <p className="text-gray-600 mt-2">
                Visão geral das métricas e atividades
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Hoje
              </Button>
              <Button>
                <BarChart3 className="h-4 w-4 mr-2" />
                Relatórios
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          variants={staggerChildren}
          initial="initial"
          animate="animate"
        >
          {[
            { 
              icon: Users, 
              label: 'Usuários Totais', 
              value: dashboardData.stats.totalUsers.toLocaleString('pt-BR'), 
              change: '+12.5%', 
              color: 'text-blue-600' 
            },
            { 
              icon: DollarSign, 
              label: 'Receita Total', 
              value: `R$ ${dashboardData.stats.totalRevenue.toLocaleString('pt-BR')}`, 
              change: '+18.2%', 
              color: 'text-green-600' 
            },
            { 
              icon: Zap, 
              label: 'Pedidos Ativos', 
              value: dashboardData.stats.totalOrders.toString(), 
              change: '+5.1%', 
              color: 'text-yellow-600' 
            },
            { 
              icon: Layers, 
              label: 'Projetos Ativos', 
              value: dashboardData.stats.activeProjects.toString(), 
              change: '+2.3%', 
              color: 'text-purple-600' 
            }
          ].map((stat, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold mb-2">{stat.value}</p>
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {stat.change}
                      </Badge>
                    </div>
                    <div className={`p-3 rounded-full bg-gray-100 ${stat.color}`}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Atividade Recente
                </CardTitle>
                <CardDescription>
                  Últimas ações no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.recentActivity.map((activity) => {
                    const IconComponent = getActivityIcon(activity.type)
                    return (
                      <motion.div
                        key={activity.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <div className="p-2 rounded-full bg-white shadow-sm">
                          <IconComponent className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.message}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <p className="text-xs text-gray-500">
                              {activity.timestamp}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Project Status */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Status dos Projetos
                </CardTitle>
                <CardDescription>
                  Acompanhamento do progresso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {dashboardData.projectStatus.map((project) => (
                    <motion.div
                      key={project.id}
                      className="space-y-3"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(project.status)}`} />
                          <h3 className="font-medium">{project.name}</h3>
                        </div>
                        <Badge className={`${getStatusBadgeColor(project.status)} border`}>
                          {project.status === 'completed' ? 'Concluído' :
                           project.status === 'on-track' ? 'No Prazo' : 'Atrasado'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progresso: {project.progress}%</span>
                          <span className="text-gray-500">
                            Prazo: {new Date(project.dueDate).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <Progress value={project.progress} className="h-2" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}