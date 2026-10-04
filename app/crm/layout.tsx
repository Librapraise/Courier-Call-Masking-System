import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Persian Team Management | Ops, Inventory & Dispatch',
  description: 'Bilingual Delivery, Inventory Depletion & Courier Cash Settlement Engine',
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* Complete invisible scrollbars for Persian Team Management */
        .no-scrollbar::-webkit-scrollbar,
        aside::-webkit-scrollbar,
        [data-scrollbar="hidden"]::-webkit-scrollbar {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
          background: transparent !important;
        }
        .no-scrollbar::-webkit-scrollbar-thumb,
        aside::-webkit-scrollbar-thumb,
        [data-scrollbar="hidden"]::-webkit-scrollbar-thumb {
          display: none !important;
          background: transparent !important;
        }
        .no-scrollbar::-webkit-scrollbar-track,
        aside::-webkit-scrollbar-track,
        [data-scrollbar="hidden"]::-webkit-scrollbar-track {
          display: none !important;
          background: transparent !important;
        }
        .no-scrollbar::-webkit-scrollbar-button,
        aside::-webkit-scrollbar-button,
        [data-scrollbar="hidden"]::-webkit-scrollbar-button {
          display: none !important;
          width: 0px !important;
          height: 0px !important;
        }
        .no-scrollbar,
        aside,
        [data-scrollbar="hidden"] {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      {children}
    </>
  )
}

