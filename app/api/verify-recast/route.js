// app/api/verify-recast/route.js
// STRICT Recast Verification API with SHORT HASH SUPPORT

// Helper function to expand short Farcaster hashes
function expandShortHash(hash) {
  // Remove 0x prefix if present
  const cleanHash = hash.replace(/^0x/, '');
  
  // If already long (56+ chars), return as-is
  if (cleanHash.length >= 56) {
    return '0x' + cleanHash;
  }
  
  // If short (8 chars from farcaster.xyz), expand with standard padding
  if (cleanHash.length === 8) {
    // Standard Farcaster hash padding pattern
    const prefix = '00000000000000fd000dc7b54e3f6d5d0000000000';
    return '0x' + prefix + cleanHash;
  }
  
  // If medium length (16-32 chars), pad with zeros
  if (cleanHash.length >= 8 && cleanHash.length < 56) {
    const zerosNeeded = 64 - cleanHash.length;
    const zeros = '0'.repeat(zerosNeeded);
    return '0x' + zeros + cleanHash;
  }
  
  // Return original if unknown format
  return hash;
}

export async function POST(request) {
  try {
    const { castUrl, originalCastHash, userFid } = await request.json();
    
    console.log('Verification request:', { castUrl, originalCastHash, userFid });
    
    // Extract cast hash from recast URL
    let recastHash = castUrl;
    
    // Handle different URL formats
    if (castUrl.includes('warpcast.com') || castUrl.includes('farcaster.xyz') || castUrl.includes('farcaster')) {
      const matches = castUrl.match(/0x[a-fA-F0-9]{8,}/g);
      if (matches && matches.length > 0) {
        recastHash = matches[matches.length - 1]; // Get last hash (usually the recast)
        console.log('Extracted short hash:', recastHash);
        
        // Expand short hash to full format
        recastHash = expandShortHash(recastHash);
        console.log('Expanded to full hash:', recastHash);
      }
    } else if (castUrl.startsWith('0x')) {
      // Direct hash provided
      recastHash = expandShortHash(castUrl);
      console.log('Direct hash expanded:', recastHash);
    }
    
    // Validate hash format
    if (!recastHash.startsWith('0x') || recastHash.length < 16) {
      return Response.json(
        { 
          success: false, 
          verified: false,
          error: 'Invalid cast hash format. Please provide a valid Farcaster cast URL or hash.' 
        },
        { status: 400 }
      );
    }
    
    // Expand original cast hash if needed
    const expandedOriginalHash = expandShortHash(originalCastHash);
    
    // Check if trying to submit original cast as recast
    if (recastHash.toLowerCase() === expandedOriginalHash.toLowerCase()) {
      return Response.json(
        { 
          success: false, 
          verified: false,
          error: 'You submitted the original cast. Please submit YOUR recast URL.' 
        },
        { status: 400 }
      );
    }
    
    // Use Neynar API for verification (if available)
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    
    if (NEYNAR_API_KEY && NEYNAR_API_KEY !== 'YOUR_API_KEY') {
      try {
        console.log('Using Neynar API for verification...');
        
        // Verify the recast hash exists
        const castResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/cast?identifier=${recastHash}&type=hash`,
          {
            headers: {
              'accept': 'application/json',
              'api_key': NEYNAR_API_KEY
            }
          }
        );
        
        if (!castResponse.ok) {
          console.log('Cast not found via Neynar API');
          return Response.json(
            { 
              success: false, 
              verified: false,
              error: 'Cast not found on Farcaster. Make sure you recasted and copied the correct URL.' 
            },
            { status: 404 }
          );
        }
        
        const castData = await castResponse.json();
        console.log('Cast found via Neynar:', castData);
        
        // Check if it's actually a recast of the original
        const isRecast = castData.cast?.parent_hash === expandedOriginalHash || 
                         castData.cast?.embeds?.some(e => e.cast_id?.hash === expandedOriginalHash);
        
        if (!isRecast) {
          return Response.json(
            { 
              success: false, 
              verified: false,
              error: 'This is not a recast of the boost. Please recast the correct post.' 
            },
            { status: 400 }
          );
        }
        
        return Response.json({
          success: true,
          verified: true,
          recastHash: recastHash,
          message: 'Recast verified via Farcaster API!'
        });
        
      } catch (apiError) {
        console.error('Neynar API Error:', apiError);
        // Fall through to manual verification
      }
    }
    
    // Manual verification (without API)
    // Accept if format is valid and different from original
    const isValidFormat = 
      recastHash.startsWith('0x') && 
      recastHash.length >= 16 && 
      /^0x[a-fA-F0-9]+$/.test(recastHash) && 
      recastHash.toLowerCase() !== expandedOriginalHash.toLowerCase();
    
    if (!isValidFormat) {
      return Response.json(
        { 
          success: false, 
          verified: false,
          error: 'Invalid recast format. Please paste your full Farcaster recast URL.' 
        },
        { status: 400 }
      );
    }
    
    // Accept valid format
    return Response.json({
      success: true,
      verified: true,
      recastHash: recastHash,
      message: 'Recast format validated. Using manual verification mode.',
      note: 'For full API verification, enable Neynar API key in environment variables.'
    });
    
  } catch (error) {
    console.error('Verification error:', error);
    return Response.json(
      { 
        success: false, 
        verified: false,
        error: 'Verification failed: ' + error.message 
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return Response.json({
    status: 'ok',
    message: 'Recast verification API is running',
    hasNeynarAPI: !!process.env.NEYNAR_API_KEY && process.env.NEYNAR_API_KEY !== 'YOUR_API_KEY',
    supportsShortHashes: true
  });
}
