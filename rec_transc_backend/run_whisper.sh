#!/bin/bash

source /home/dave/whisper-venv/bin/activate
whisper "$1" \
        --language $2 \
        --output_dir /var/www/rec_transc_backend/src/uploads/ \
        > /var/www/html/rec_transc/transcribed_text.txt 2>&1
exit 0
