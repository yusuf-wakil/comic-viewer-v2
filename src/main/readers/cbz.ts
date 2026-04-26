import unzipper from 'unzipper'

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i

export async function extractPages(filePath: string): Promise<Buffer[]> {
  const directory = await unzipper.Open.file(filePath)
  const imageFiles = directory.files.filter((f) => IMAGE_EXTENSIONS.test(f.path))
  imageFiles.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
  return Promise.all(imageFiles.map((f) => f.buffer()))
}

export async function extractCover(filePath: string): Promise<Buffer | null> {
  const pages = await extractPages(filePath)
  return pages[0] ?? null
}
