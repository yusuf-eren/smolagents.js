// Mock for sharp module to avoid platform compatibility issues in tests
// This mock provides the same API structure as sharp but returns mock data

const mockSharp = (input) => {
  const mockInstance = {
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mocked-image-data')),
    toFile: jest.fn().mockResolvedValue({ format: 'jpeg', width: 100, height: 100 }),
    metadata: jest.fn().mockResolvedValue({ 
      format: 'jpeg', 
      width: 100, 
      height: 100, 
      channels: 3 
    }),
  };

  return mockInstance;
};

// Add static methods that sharp module has
mockSharp.format = {
  jpeg: { id: 'jpeg' },
  png: { id: 'png' },
  webp: { id: 'webp' }
};

module.exports = mockSharp;
