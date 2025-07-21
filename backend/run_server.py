#!/usr/bin/env python3

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    import uvicorn
    
    print("✅ Starting NOVA backend server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
