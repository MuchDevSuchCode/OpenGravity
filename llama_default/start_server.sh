#!/bin/bash

MODEL_DIR="$HOME/models"
HOST="0.0.0.0"
PORT="8080"
LLAMA_SERVER="/home/ai/llama.cpp/build/bin/llama-server"

# --- GOD MODE TUNE ---
CONTEXT_SIZE="131072"
PARALLEL_SLOTS="1"
CPU_CORES="16"
# ---------------------

# Ensure the models directory exists
mkdir -p "$MODEL_DIR"

echo "==========================================================="
echo "  STRIX HALO: GOD MODE (128K CONTEXT / SINGLE SLOT)"
echo "==========================================================="

# --- 1. AUTO-ORGANIZER MODULE ---
# Find loose .gguf files strictly in the root of MODEL_DIR
shopt -s nullglob
loose_files=("$MODEL_DIR"/*.gguf)
shopt -u nullglob

if [ ${#loose_files[@]} -gt 0 ]; then
    echo " [System] Found ${#loose_files[@]} loose .gguf file(s). Organizing first..."
    for file in "${loose_files[@]}"; do
        filename=$(basename "$file")

        # Strip split syntax and extension to get a clean folder name
        folder_name=$(echo "$filename" | sed -E 's/-[0-9]{5}-of-[0-9]{5}//g' | sed 's/\.gguf$//')
        target_dir="$MODEL_DIR/$folder_name"

        if [ ! -d "$target_dir" ]; then
            mkdir -p "$target_dir"
        fi

        mv "$file" "$target_dir/"
        echo "   -> Moved: $filename into $folder_name/"
    done
    echo " [System] Cleanup complete!"
    echo "==========================================================="
fi

# --- 2. MENU AND LAUNCHER MODULE ---
models=()
display_names=()
folder_sizes=()

# Loop through all subdirectories inside MODEL_DIR
for dir in "$MODEL_DIR"/*/; do
    [ -d "$dir" ] || continue

    first_file=$(ls -1 "$dir"/*.gguf 2>/dev/null | head -n 1)
    if [[ -n "$first_file" ]]; then
        models+=("$first_file")
        display_names+=("$(basename "$dir")")
        folder_sizes+=("$(du -sh "$dir" | cut -f1)")
    fi
done

if [ ${#models[@]} -eq 0 ]; then
    echo " ERROR: No model folders containing .gguf files found in $MODEL_DIR"
    exit 1
fi

echo " Available Models:"
for i in "${!models[@]}"; do
    printf "   [%2d] %-50s | %5s\n" "$i" "${display_names[$i]}" "${folder_sizes[$i]}"
done
echo "==========================================================="

read -p " Select model: " selection

if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -ge "${#models[@]}" ] || [ "$selection" -lt 0 ]; then
    echo " Invalid selection. Exiting."
    exit 1
fi

MODEL_PATH="${models[$selection]}"
MODEL_NAME="${display_names[$selection]}"

echo "==========================================================="
echo " Deploying God Mode..."
echo " Model:   $MODEL_NAME"
echo " Context: 128K"
echo "==========================================================="

$LLAMA_SERVER \
    -m "$MODEL_PATH" \
    -c $CONTEXT_SIZE \
    -np $PARALLEL_SLOTS \
    -t $CPU_CORES \
    -tb $CPU_CORES \
    -ngl 999 \
    -fa 1 \
    --no-mmap \
    --no-warmup \
    --metrics \
    --host $HOST \
    --port $PORT
