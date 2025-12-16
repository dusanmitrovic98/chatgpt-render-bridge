import threading
import time
import uuid
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- JOB QUEUE ---
job_queue = []
active_job = None
completed_jobs = {} 

# --- 1. HEALTH CHECK (REQUIRED FOR RENDER) ---
@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "online",
        "service": "ChatGPT Automation Bridge",
        "jobs_in_queue": len(job_queue),
        "message": "Render Health Check Passed"
    }), 200

# --- 2. OPENAI API ENDPOINT ---
@app.route('/v1/chat/completions', methods=['POST'])
def openai_chat():
    data = request.json
    messages = data.get('messages', [])
    if not messages:
        return jsonify({"error": {"message": "No messages provided"}}), 400

    last_user_msg = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), None)
    if not last_user_msg:
        return jsonify({"error": {"message": "No user message found"}}), 400

    job_id = str(uuid.uuid4())
    job_event = threading.Event()
    
    job = {
        "id": job_id,
        "prompt": last_user_msg,
        "event": job_event
    }
    
    job_queue.append(job)
    print(f"[API] Job {job_id[:8]} queued: {last_user_msg[:30]}...")

    # Wait for Browser (Timeout 3 mins)
    success = job_event.wait(timeout=180)

    if success:
        answer_text = completed_jobs.pop(job_id, "Error: Result lost")
        response = {
            "id": "chatcmpl-" + job_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": "gpt-4-industrial-bridge",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": answer_text},
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": len(last_user_msg), "completion_tokens": len(answer_text), "total_tokens": 0}
        }
        return jsonify(response)
    else:
        return jsonify({"error": {"message": "Request Timed Out"}}), 504

# --- 3. BROWSER POLLING ---
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
    # RENDER CONFIGURATION:
    # Render sets the 'PORT' environment variable. We must listen on that port.
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 OpenAI Bridge Running on Port {port}")
    # Host must be 0.0.0.0 to be accessible outside the Docker container
    app.run(host='0.0.0.0', port=port, threaded=True)