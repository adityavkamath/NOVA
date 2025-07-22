import CsvUploader from '@/components/CSVuploader'
import React from 'react'

const page = () => {
  return (
    <div className='w-full h-[90vh] flex flex-col items-center justify-center'>
      <CsvUploader />
    </div>
  )
}

export default page
