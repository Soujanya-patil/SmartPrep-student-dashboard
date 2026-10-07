// Extract the 11-char video ID from watch?v=, youtu.be/, /embed/ or /shorts/ URLs
export function getYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null
  const match = url.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : null
}

/** A normal youtube.com link for a video, for opening it outside the app */
export function youtubeWatchUrl(url: string): string {
  const id = getYouTubeId(url)
  return id ? `https://www.youtube.com/watch?v=${id}` : url
}
