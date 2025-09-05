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

// This would come from a database in a real application
let posts: Post[] = []

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const postId = parseInt(params.id)
    const postIndex = posts.findIndex(p => p.id === postId)

    if (postIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Post não encontrado'
        },
        { status: 404 }
      )
    }

    const post = posts[postIndex]
    const wasLiked = post.liked

    posts[postIndex] = {
      ...post,
      liked: !wasLiked,
      likes: wasLiked ? post.likes - 1 : post.likes + 1
    }

    return NextResponse.json({
      success: true,
      data: posts[postIndex],
      action: wasLiked ? 'unliked' : 'liked'
    })
  } catch (error) {
    console.error('Error toggling like:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor'
      },
      { status: 500 }
    )
  }
}