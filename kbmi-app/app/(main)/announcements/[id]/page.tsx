'use client'

import { useState, use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Heart } from 'lucide-react'
import { useLang } from '@/lib/language-context'
import { useAuth } from '@/lib/auth-context'
import { useData } from '@/lib/data-context'
import { Comment } from '@/lib/mock-data'
import { sanitizeHtml } from '@/lib/sanitize'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import MediaCarousel from '@/components/MediaCarousel'

export default function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { tr, lang } = useLang()
  const { user } = useAuth()
  const { announcements, users, addComment, toggleLike, addAuditEntry } = useData()

  const ann = announcements.find((a) => a.id === id)
  const [newComment, setNewComment] = useState('')
  const liked = ann ? ann.likedBy.includes(user?.id ?? '') : false

  if (!ann) {
    return (
      <div className="text-center py-12 text-gray-400">
        {lang === 'en' ? 'Announcement not found.' : 'Pengumuman tidak dijumpai.'}
      </div>
    )
  }

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return
    const comment: Comment = {
      id: `c${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      content: newComment,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    addComment(ann.id, comment)
    addAuditEntry(`Commented on announcement: "${ann.title}"`, user.name, 'Announcement')
    setNewComment('')
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-3 pb-3">
        <Link href="/announcements" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-semibold text-gray-600">
          {lang === 'en' ? 'Back to Bulletin' : 'Kembali ke Buletin'}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 p-4 pb-3">
          <Avatar className="h-10 w-10 bg-emerald-100">
            {users.find((u) => u.id === ann.authorId)?.profilePhoto && (
              <AvatarImage src={users.find((u) => u.id === ann.authorId)!.profilePhoto!} />
            )}
            <AvatarFallback className="text-sm font-semibold text-emerald-800">
              {ann.authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-semibold text-gray-900">{ann.authorName}</div>
            <div className="text-xs text-gray-400">{ann.createdAt}</div>
          </div>
        </div>

        {ann.media.length > 0 && <MediaCarousel media={ann.media} aspectRatio="landscape" />}

        <div className="p-4">
          <h2 className="text-lg font-bold text-gray-900 mb-3 leading-snug">{ann.title}</h2>
          {ann.htmlContent ? (
            <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(ann.htmlContent) }}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{ann.content}</p>
          )}

          <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3">
            <button
              onClick={() => user && toggleLike(ann.id, user.id)}
              className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
            >
              <Heart className={`h-4 w-4 ${liked ? 'fill-red-500' : ''}`} />
              <span className="text-xs">{liked ? (lang === 'en' ? 'Liked' : 'Disukai') : 'Like'}</span>
              {ann.likedBy.length > 0 && <span className="text-xs">· {ann.likedBy.length}</span>}
            </button>
            <span className="text-xs text-gray-400">{ann.comments.length} {tr.comments}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {tr.comments} ({ann.comments.length})
        </h3>

        {ann.comments.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            {lang === 'en' ? 'No comments yet. Be the first!' : 'Tiada komen lagi. Jadilah yang pertama!'}
          </p>
        )}

        {ann.comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-8 w-8 bg-gray-100 shrink-0">
              {users.find((u) => u.id === c.authorId)?.profilePhoto && (
                <AvatarImage src={users.find((u) => u.id === c.authorId)!.profilePhoto!} />
              )}
              <AvatarFallback className="text-xs font-semibold text-gray-600">
                {c.authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 rounded-2xl bg-white p-3 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-gray-800">{c.authorName}</span>
                <span className="text-xs text-gray-400">{c.createdAt}</span>
              </div>
              <p className="text-sm text-gray-600">{c.content}</p>
            </div>
          </div>
        ))}

        <form onSubmit={handleComment} className="flex gap-3 items-end mt-2">
          <Avatar className="h-8 w-8 bg-emerald-100 shrink-0 mb-1">
            {user?.profilePhoto && <AvatarImage src={user.profilePhoto} />}
            <AvatarFallback className="text-xs font-semibold text-emerald-800">{user?.avatar}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={lang === 'en' ? 'Write a comment...' : 'Tulis komen...'}
              rows={2}
              className="resize-none"
            />
          </div>
          <Button type="submit" size="sm" className="mb-1 bg-emerald-700 hover:bg-emerald-800 text-white">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
