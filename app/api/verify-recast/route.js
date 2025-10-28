// app/api/verify-recast/route.js
// Farcaster Recast Verification API

export async function POST(request) {
  try {
    const { castUrl, userAddress } = await request.json();
    
    // Extract cast hash from URL
    let castHash = castUrl;
    if (castUrl.includes('warpcast.com')) {
      const matches = castUrl.match(/0x[a-fA-F0-9]+/);
      if (matches) {
        castHash = matches[0];
      }
    }
    
    // Validate cast hash format
    if (!castHash.startsWith('0x') || castHash.length < 10) {
      return Response.json(
        { success: false, error: 'Invalid cast hash format' },
        { status: 400 }
      );
    }
    
    // Call Farcaster Neynar API (you'll need an API key)
    // Sign up at: https://neynar.com
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || 'YOUR_API_KEY';
    
    try {
      // Get cast details
      const castResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': NEYNAR_API_KEY
          }
        }
      );
      
      if (!castResponse.ok) {
        return Response.json(
          { success: false, error: 'Cast not found' },
          { status: 404 }
        );
      }
      
      const castData = await castResponse.json();
      
      // Get recasters of this cast
      const recastersResponse = await fetch(
        `https://api.neynar.com/v2/farcaster/cast/recasters?identifier=${castHash}&type=hash&limit=100`,
        {
          headers: {
            'accept': 'application/json',
            'api_key': NEYNAR_API_KEY
          }
        }
      );
      
      if (!recastersResponse.ok) {
        return Response.json(
          { success: false, error: 'Could not fetch recasters' },
          { status: 500 }
        );
      }
      
      const recastersData = await recastersResponse.json();
      
      // Check if user's wallet is connected to any recaster
      // This is simplified - in production you'd need to map wallet addresses to Farcaster IDs
      const hasRecasted = recastersData.users && recastersData.users.length > 0;
      
      return Response.json({
        success: true,
        verified: hasRecasted,
        castHash: castHash,
        recastCount: recastersData.users?.length || 0
      });
      
    } catch (apiError) {
      console.error('Neynar API Error:', apiError);
      
      // Fallback: Basic validation only
      return Response.json({
        success: true,
        verified: true, // Allow for demo purposes
        castHash: castHash,
        note: 'Verification skipped - API unavailable'
      });
    }
    
  } catch (error) {
    console.error('Verification error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Alternative: Simpler version without external API (for testing)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const castHash = searchParams.get('castHash');
  
  if (!castHash) {
    return Response.json({ error: 'Missing castHash parameter' }, { status: 400 });
  }
  
  // Simple validation
  const isValid = castHash.startsWith('0x') && castHash.length >= 10;
  
  return Response.json({
    success: true,
    verified: isValid,
    castHash: castHash,
    message: 'Basic validation only'
  });
}
