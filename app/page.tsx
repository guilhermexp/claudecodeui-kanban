'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { 
  Calendar,
  Clock,
  Heart,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Star,
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

interface Task {
  id: number
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'completed'
  priority: 'low' | 'medium' | 'high'
  assignee: {
    name: string
    avatar: string
  }
  progress: number
  dueDate: string
}

interface Post {
  id: number
  author: {
    name: string
    avatar: string
    username: string
  }
  content: string
  likes: number
  comments: number
  timestamp: string
  liked: boolean
}

const sampleTasks: Task[] = [
  {
    id: 1,
    title: 'Implementar autenticação',
    description: 'Configurar sistema de login com Next-Auth',
    status: 'in-progress',
    priority: 'high',
    assignee: {
      name: 'Ana Silva',
      avatar: '/api/placeholder/32/32'
    },
    progress: 75,
    dueDate: '2025-01-08'
  },
  {
    id: 2,
    title: 'Design do dashboard',
    description: 'Criar interface responsiva para o painel administrativo',
    status: 'pending',
    priority: 'medium',
    assignee: {
      name: 'Carlos Santos',
      avatar: '/api/placeholder/32/32'
    },
    progress: 0,
    dueDate: '2025-01-12'
  },
  {
    id: 3,
    title: 'Integração com API',
    description: 'Conectar com serviços externos e configurar endpoints',
    status: 'completed',
    priority: 'high',
    assignee: {
      name: 'Maria Oliveira',
      avatar: '/api/placeholder/32/32'
    },
    progress: 100,
    dueDate: '2025-01-05'
  }
]

const samplePosts: Post[] = [
  {
    id: 1,
    author: {
      name: 'João Pereira',
      avatar: '/api/placeholder/40/40',
      username: '@joaopereira'
    },
    content: 'Acabei de finalizar um novo projeto usando Next.js 15 e Supabase. A nova versão está incrível! 🚀',
    likes: 24,
    comments: 8,
    timestamp: '2h',
    liked: false
  },
  {
    id: 2,
    author: {
      name: 'Fernanda Costa',
      avatar: '/api/placeholder/40/40',
      username: '@fernandacosta'
    },
    content: 'Dica do dia: usar Server Components do React 18 pode melhorar significativamente a performance da sua aplicação. Alguém mais testou?',
    likes: 45,
    comments: 12,
    timestamp: '4h',
    liked: true
  },
  {
    id: 3,
    author: {
      name: 'Ricardo Lima',
      avatar: '/api/placeholder/40/40',
      username: '@ricardolima'
    },
    content: 'Trabalhando em uma nova feature de chat em tempo real. WebSockets + TypeScript = ❤️',
    likes: 18,
    comments: 5,
    timestamp: '6h',
    liked: false
  }
]

export default function HomePage() {
  const [tasks, setTasks] = useState<Task[]>(sampleTasks)
  const [posts, setPosts] = useState<Post[]>(samplePosts)
  const [newTask, setNewTask] = useState({ title: '', description: '' })
  const [newPost, setNewPost] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const handleAddTask = () => {
    if (newTask.title.trim() && newTask.description.trim()) {
      const task: Task = {
        id: tasks.length + 1,
        title: newTask.title,
        description: newTask.description,
        status: 'pending',
        priority: 'medium',
        assignee: {
          name: 'Você',
          avatar: '/api/placeholder/32/32'
        },
        progress: 0,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
      setTasks([...tasks, task])
      setNewTask({ title: '', description: '' })
    }
  }

  const handleLikePost = (postId: number) => {
    setPosts(posts.map(post => 
      post.id === postId 
        ? { ...post, liked: !post.liked, likes: post.liked ? post.likes - 1 : post.likes + 1 }
        : post
    ))
  }

  const handleAddPost = () => {
    if (newPost.trim()) {
      const post: Post = {
        id: posts.length + 1,
        author: {
          name: 'Você',
          avatar: '/api/placeholder/40/40',
          username: '@voce'
        },
        content: newPost,
        likes: 0,
        comments: 0,
        timestamp: 'agora',
        liked: false
      }
      setPosts([post, ...posts])
      setNewPost('')
    }
  }

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'in-progress': return 'bg-blue-500'
      default: return 'bg-gray-400'
    }
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high': return 'border-red-500 text-red-700 bg-red-50'
      case 'medium': return 'border-yellow-500 text-yellow-700 bg-yellow-50'
      default: return 'border-green-500 text-green-700 bg-green-50'
    }
  }

  const filteredTasks = tasks.filter(task => 
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    task.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
                Modern Fullstack App
              </h1>
              <p className="text-gray-600 mt-2">
                Construído com Next.js 15, TypeScript e Tailwind CSS
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar tarefas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          variants={staggerChildren}
          initial="initial"
          animate="animate"
        >
          {[
            { icon: Users, label: 'Usuários Ativos', value: '1,234', change: '+12%', color: 'text-blue-600' },
            { icon: TrendingUp, label: 'Vendas', value: 'R$ 45,678', change: '+18%', color: 'text-green-600' },
            { icon: Zap, label: 'Performance', value: '98.5%', change: '+2%', color: 'text-yellow-600' },
            { icon: Star, label: 'Avaliação', value: '4.8/5', change: '+0.3', color: 'text-purple-600' }
          ].map((stat, index) => (
            <motion.div key={index} variants={fadeInUp}>
              <Card className="hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <div className="flex items-center mt-2">
                        <Badge variant="secondary" className="text-green-700 bg-green-100">
                          {stat.change}
                        </Badge>
                      </div>
                    </div>
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content */}
        <Tabs defaultValue="tasks" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tasks">Gerenciamento de Tarefas</TabsTrigger>
            <TabsTrigger value="social">Feed Social</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-6">
            {/* Add New Task */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Nova Tarefa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Título da tarefa..."
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                  <Textarea
                    placeholder="Descrição da tarefa..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                  <Button onClick={handleAddTask} className="w-full">
                    Adicionar Tarefa
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tasks List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ delay: index * 0.1 }}
                    layout
                  >
                    <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{task.title}</CardTitle>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`} />
                            <Badge className={`${getPriorityColor(task.priority)} border`}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription>{task.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={task.assignee.avatar} />
                            <AvatarFallback>
                              {task.assignee.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-600">{task.assignee.name}</span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progresso</span>
                            <span>{task.progress}%</span>
                          </div>
                          <Progress value={task.progress} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {task.status === 'completed' ? 'Concluído' : 
                             task.status === 'in-progress' ? 'Em andamento' : 'Pendente'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            {/* New Post */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Compartilhe algo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="O que você está pensando?"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <Button onClick={handleAddPost} className="w-full">
                    Publicar
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Posts Feed */}
            <div className="space-y-6">
              <AnimatePresence>
                {posts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ delay: index * 0.1 }}
                    layout
                  >
                    <Card className="hover:shadow-lg transition-shadow duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={post.author.avatar} />
                            <AvatarFallback>
                              {post.author.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">{post.author.name}</h3>
                                <p className="text-sm text-gray-600">{post.author.username}</p>
                              </div>
                              <span className="text-sm text-gray-500">{post.timestamp}</span>
                            </div>
                            
                            <p className="text-gray-900 leading-relaxed">{post.content}</p>
                            
                            <div className="flex items-center gap-6 pt-2">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleLikePost(post.id)}
                                className={`flex items-center gap-2 text-sm transition-colors ${
                                  post.liked ? 'text-red-600' : 'text-gray-600 hover:text-red-600'
                                }`}
                              >
                                <Heart className={`h-4 w-4 ${post.liked ? 'fill-current' : ''}`} />
                                {post.likes}
                              </motion.button>
                              
                              <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors">
                                <MessageCircle className="h-4 w-4" />
                                {post.comments}
                              </button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}