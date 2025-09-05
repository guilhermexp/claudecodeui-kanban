import { NextRequest, NextResponse } from 'next/server'

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
  createdAt: string
}

// In-memory storage for demo purposes
let posts: Post[] = [
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
    liked: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
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
    liked: true,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  }
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  const offset = parseInt(searchParams.get('offset') || '0')

  const paginatedPosts = posts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(offset, offset + limit)

  return NextResponse.json({
    success: true,
    data: paginatedPosts,
    meta: {
      total: posts.length,
      limit,
      offset,
      hasMore: offset + limit < posts.length
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, author = 'Usuário Anônimo' } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'O conteúdo do post é obrigatório'
        },
        { status: 400 }
      )
    }

    if (content.length > 280) {
      return NextResponse.json(
        {
          success: false,
          error: 'O post não pode ter mais de 280 caracteres'
        },
        { status: 400 }
      )
    }

    const newPost: Post = {
      id: Math.max(...posts.map(p => p.id), 0) + 1,
      author: {
        name: author,
        avatar: '/api/placeholder/40/40',
        username: `@${author.toLowerCase().replace(/\s+/g, '')}`
      },
      content: content.trim(),
      likes: 0,
      comments: 0,
      timestamp: 'agora',
      liked: false,
      createdAt: new Date().toISOString()
    }

    posts.unshift(newPost)

    return NextResponse.json({
      success: true,
      data: newPost
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    )
  }
}