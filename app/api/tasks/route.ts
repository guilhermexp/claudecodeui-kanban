import { NextRequest, NextResponse } from 'next/server'

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
  createdAt: string
}

// In-memory storage for demo purposes
// In a real app, you would use a database
let tasks: Task[] = [
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
    dueDate: '2025-01-08',
    createdAt: new Date().toISOString()
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
    dueDate: '2025-01-12',
    createdAt: new Date().toISOString()
  }
]

export async function GET() {
  return NextResponse.json({
    success: true,
    data: tasks
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, priority = 'medium', assignee = 'Sistema' } = body

    if (!title || !description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Título e descrição são obrigatórios'
        },
        { status: 400 }
      )
    }

    const newTask: Task = {
      id: Math.max(...tasks.map(t => t.id), 0) + 1,
      title,
      description,
      status: 'pending',
      priority,
      assignee: {
        name: assignee,
        avatar: '/api/placeholder/32/32'
      },
      progress: 0,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    }

    tasks.push(newTask)

    return NextResponse.json({
      success: true,
      data: newTask
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    )
  }
}