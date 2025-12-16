import threading
import time
import uuid
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- JOB QUEUE (Same logic as before) ---
job_queue = []
active_job = None
completed_jobs = {} 

@app.route('/v1/chat/completions', methods=['POST'])
def openai_chat():
    data = request.json
    
    # 1. Parse OpenAI Format
    # OpenAI sends: { "model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}] }
    messages = data.get('messages', [])
    if not messages:
        return jsonify({"error": {"message": "No messages provided"}}), 400

    # Extract the last user message to send to the browser
    last_user_msg = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), None)
    if not last_user_msg:
        return jsonify({"error": {"message": "No user message found"}}), 400

    # 2. Queue the Job
    job_id = str(uuid.uuid4())
    job_event = threading.Event()
    
    job = {
        "id": job_id,
        "prompt": last_user_msg,
        "event": job_event
    }
    
    job_queue.append(job)
    print(f"[API] Job {job_id[:8]} queued: {last_user_msg[:30]}...")

    # 3. Wait for Browser (Timeout 3 mins)
    success = job_event.wait(timeout=180)

    # 4. Format Response as OpenAI JSON
    if success:
        answer_text = completed_jobs.pop(job_id, "Error: Result lost")
        
        # This is the exact JSON structure OpenAI returns
        response = {
            "id": "chatcmpl-" + job_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "gpt-4-industrial-bridge",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": answer_text
                    },
                    "finish_reason": "stop"
                }
            ],
            "usage": {
                "prompt_tokens": len(last_user_msg),
                "completion_tokens": len(answer_text),
                "total_tokens": len(last_user_msg) + len(answer_text)
            }
        }
        return jsonify(response)
    else:
        return jsonify({"error": {"message": "Request Timed Out"}}), 504

# --- BROWSER POLLING (The internal API) ---
@app.route('/poll', methods=['GET'])
def poll():
    global active_job
    if active_job: return jsonify({"has_work": True, "prompt": active_job['prompt'], "id": active_job['id']})
    if len(job_queue) > 0:
        active_job = job_queue.pop(0)
        return jsonify({"has_work": True, "prompt": active_job['prompt'], "id": active_job['id']})
    return jsonify({"has_work": False})

@app.route('/reply', methods=['POST'])
def reply():
    global active_job
    data = request.json
    if active_job:
        completed_jobs[active_job['id']] = data.get("answer")
        active_job['event'].set()
        active_job = None
        return "OK"
    return "No active job", 200

if __name__ == '__main__':
    print("🚀 OpenAI-Compatible Bridge Running on :5000")
    app.run(port=5000, host='0.0.0.0', threaded=True)