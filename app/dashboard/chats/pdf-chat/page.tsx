import PdfUploader from '@/components/PDFuploader'
import React from 'react'

const page = () => {
  return (
    <div className='w-full h-[90vh] flex flex-col items-center justify-center'>
      <PdfUploader />
    </div>
  )
}

export default page
