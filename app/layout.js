export const metadata = {
  title: 'PaidCaster - Boost Your Casts, Earn Rewards',
  description: 'Pay to amplify your Farcaster posts. Get rewarded for spreading the word.',
  openGraph: {
    title: 'PaidCaster - Boost & Earn',
    description: 'Boost Farcaster casts and earn ETH rewards on Base',
    images: ['https://paidcaster.vercel.app/og-image.png'],
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:image': 'https://paidcaster.vercel.app/og-image.png',
    'fc:frame:button:1': 'Launch PaidCaster',
    'fc:frame:button:1:action': 'link',
    'fc:frame:button:1:target': 'https://paidcaster.vercel.app',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
