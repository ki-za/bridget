import type { JSX } from 'solid-js'
import type { ImageInfo } from '../resources' // Adjust import path

// Naming: ImageInfoPanel = UI component displaying image metadata
export default function ImageInfoPanel(props: {
  info: ImageInfo // The metadata to display
}): JSX.Element {
  return (
    <div class="image-info-panel">
      <div class="image-info-content">{/* Add more fields as needed */}</div>
    </div>
  )
}
