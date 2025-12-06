// data structure for images info
export interface ImageJSON {
  index: number
  alt: string
  loUrl: string
  loImgH: number
  loImgW: number
  hiUrl: string
  hiImgH: number
  hiImgW: number
  imageInfo?: ImageInfo
}

// data structure for track/image contribution metadata
export interface TrackInfo {
  name: string // Track/section name: "The Golden Horn"
  contributionTags?: string[] // Artist's role: ["photographed", "composed"]
}

// data structure for project/album/series metadata
export interface ImageInfo {
  artistName: string // "Alex Webb"
  artistLink: string // "https://alexwebb.com"
  projectName: string // "Istanbul: City of a Hundred Names"
  spotifyLink?: string // "https://open.spotify.com/..."
  appleMusicLink?: string // "https://podcasts.apple.com/..."
  releaseYear: number // 2007
  projectContributionTags?: string[] // ["photographer", "author"]
  releasedBy?: string[] // ["Aperture Foundation"]
  releasedByLink: string // "https://aperture.org"
  collaborators?: string[] // ["Orhan Pamuk"]
  trackList?: TrackInfo[] // Array of tracks/sections
}

export async function getImageJSON(): Promise<ImageJSON[]> {
  if (document.title.split(' | ')[0] === '404') {
    return [] // no images on 404 page
  }

  const ogUrlMetaTag = document.querySelector(
    'meta[property="og:url"]'
  ) as HTMLMetaElement | null
  const indexJsonUrl = ogUrlMetaTag?.content
    ? new URL('index.json', ogUrlMetaTag.content).href
    : new URL('index.json', window.location.href).href

  try {
    const response = await fetch(indexJsonUrl, {
      headers: {
        Accept: 'application/json'
      }
    })
    const data: ImageJSON[] = await response.json()
    return data.sort((a: ImageJSON, b: ImageJSON) => {
      if (a.index < b.index) {
        return -1
      }
      return 1
    })
  } catch (e) {
    console.error(e)
    return []
  }
}
