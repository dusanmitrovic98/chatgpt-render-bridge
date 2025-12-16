import threading
import time
import uuid
import os
import queue
import json
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- JOB MANAGEMENT ---
job_queue = []
active_job = None

# For non-streaming requests (Blocking)
completed_jobs = {} 
job_events = {}

# For streaming requests (Queues)
stream_queues = {} 

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"status": "online", "mode": "stream+block"}), 200

# --- OPENAI API ENDPOINT ---
@app.route('/v1/chat/completions', methods=['POST'])
def openai_chat():
    data = request.json
    messages = data.get('messages', [])
    is_stream = data.get('stream', False)
    
    if not messages:
        return jsonify({"error": "No messages"}), 400

    last_user_msg = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), None)
    if not last_user_msg:
        return jsonify({"error": "No user prompt"}), 400

    job_id = str(uuid.uuid4())
    
    # Create the job object
    job = {
        "id": job_id,
        "prompt": last_user_msg,
        "stream": is_stream
    }
    
    # Setup synchronization primitives
    if is_stream:
        # Create a queue for this specific job
        stream_queues[job_id] = queue.Queue()
        print(f"[API] Streaming Job {job_id[:8]} queued")
    else:
        # Create an event for blocking wait
        job_events[job_id] = threading.Event()
        print(f"[API] Blocking Job {job_id[:8]} queued")

    job_queue.append(job)

    # --- STREAMING HANDLER ---
    if is_stream:
        def generate():
            q = stream_queues[job_id]
            
            # 1. Send Role Header
            start_data = {
                "id": f"chatcmpl-{job_id}",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": "gpt-4-industrial-bridge",
                "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}]
            }
            yield f"data: {json.dumps(start_data)}\n\n"

            # 2. Wait for chunks
            while True:
                try:
                    # Timeout after 3 mins of silence to prevent hanging
                    chunk = q.get(timeout=180) 
                    
                    if chunk == "[DONE]":
                        stop_data = {
                            "id": f"chatcmpl-{job_id}",
                            "object": "chat.completion.chunk",
                            "created": int(time.time()),
                            "model": "gpt-4-industrial-bridge",
                            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
                        }
                        yield f"data: {json.dumps(stop_data)}\n\n"
                        yield "data: [DONE]\n\n"
                        break
                    
                    # Send Content Chunk
                    data_chunk = {
                        "id": f"chatcmpl-{job_id}",
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": "gpt-4-industrial-bridge",
                        "choices": [{"index": 0, "delta": {"content": chunk}, "finish_reason": None}]
                    }
                    yield f"data: {json.dumps(data_chunk)}\n\n"
                
                except queue.Empty:
                    yield "data: [DONE]\n\n"
                    break
            
            # Cleanup
            if job_id in stream_queues: del stream_queues[job_id]

        return Response(stream_with_context(generate()), mimetype='text/event-stream')

    # --- BLOCKING HANDLER (LEGACY) ---
    else:
        event = job_events[job_id]
        success = event.wait(timeout=180) # 3 min timeout

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
            if job_id in job_events: del job_events[job_id]
            return jsonify(response)
        else:
            if job_id in job_events: del job_events[job_id]
            return jsonify({"error": {"message": "Request Timed Out"}}), 504

# --- EXTENSION INTERFACE ---

@app.route('/poll', methods=['GET'])
def poll():
    global active_job
    if active_job: 
        return jsonify({"has_work": True, "prompt": active_job['prompt'], "id": active_job['id'], "stream": active_job['stream']})
    if len(job_queue) > 0:
        active_job = job_queue.pop(0)
        return jsonify({"has_work": True, "prompt": active_job['prompt'], "id": active_job['id'], "stream": active_job['stream']})
    return jsonify({"has_work": False})

@app.route('/chunk', methods=['POST'])
def receive_chunk():
    """ Receive partial text updates from extension """
    global active_job
    data = request.json
    chunk_text = data.get("chunk")
    
    if active_job and active_job['stream']:
        q = stream_queues.get(active_job['id'])
        if q:
            q.put(chunk_text)
        return jsonify({"status": "ack"})
    return jsonify({"status": "ignored"})

@app.route('/reply', methods=['POST'])
def reply():
    """ Receive FINAL text or DONE signal """
    global active_job
    data = request.json
    
    if not active_job: return "No job", 200

    job_id = active_job['id']
    
    if active_job['stream']:
        # For streaming, this endpoint signals the END
        q = stream_queues.get(job_id)
        if q: q.put("[DONE]")
    else:
        # For blocking, this saves the full text
        completed_jobs[job_id] = data.get("answer")
        ev = job_events.get(job_id)
        if ev: ev.set()

    active_job = None
    return "OK"

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Bridge Running on Port {port}")
    app.run(host='0.0.0.0', port=port, threaded=True)