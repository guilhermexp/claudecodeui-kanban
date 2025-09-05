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

// This would come from a database in a real application
let tasks: Task[] = []

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const taskId = parseInt(params.id)
  const task = tasks.find(t => t.id === taskId)

  if (!task) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tarefa não encontrada'
      },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: task
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const taskId = parseInt(params.id)
    const body = await request.json()
    
    const taskIndex = tasks.findIndex(t => t.id === taskId)
    
    if (taskIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tarefa não encontrada'
        },
        { status: 404 }
      )
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...body
    }

    return NextResponse.json({
      success: true,
      data: tasks[taskIndex]
    })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const taskId = parseInt(params.id)
  const taskIndex = tasks.findIndex(t => t.id === taskId)

  if (taskIndex === -1) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tarefa não encontrada'
      },
      { status: 404 }
    )
  }

  tasks.splice(taskIndex, 1)

  return NextResponse.json({
    success: true,
    message: 'Tarefa removida com sucesso'
  })
}