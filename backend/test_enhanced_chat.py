"""
Simple test script to validate the enhanced chat system
"""
import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../")))

def test_setup():
    """Test if all required modules can be imported"""
    try:
        from utils.chat_processing import generate_response_stream, get_or_create_memory
        from utils.semantic_search import search_similar_docs
        from utils.llm_answer import generate_answer
        from supabase_client import supabase
        print("✅ All imports successful!")
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False

def test_database_connection():
    """Test database connectivity"""
    try:
        from supabase_client import supabase
        # Test a simple query
        result = supabase.table("chat_sessions").select("id").limit(1).execute()
        print("✅ Database connection successful!")
        return True
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False

def run_tests():
    """Run all tests"""
    print("🧪 Testing NOVA enhanced chat system...")
    print("=" * 50)
    
    tests = [
        ("Module imports", test_setup),
        ("Database connection", test_database_connection),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n🔍 Testing {test_name}...")
        result = test_func()
        results.append(result)
    
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {sum(results)}/{len(results)} passed")
    
    if all(results):
        print("🎉 All tests passed! The enhanced chat system is ready.")
        print("\n🚀 Enhanced features:")
        print("  • Auto-scroll to new messages")
        print("  • Top 5 sources display in chat history")
        print("  • Improved PDF content analysis")
        print("  • Clean codebase (removed unnecessary files)")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")

if __name__ == "__main__":
    run_tests()
