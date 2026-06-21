FROM nginx:alpine

# Install wget for fetching settings from backend + bash for the scripts.
# (alpine ships busybox wget which is fine for our needs, but we also
# install bash for cleaner string handling in the scripts.)
RUN apk add --no-cache wget bash

# Copy the template and scripts
COPY nginx.conf.template /etc/nginx/nginx.conf.template
COPY scripts/regen-config.sh /etc/nginx/scripts/regen-config.sh
COPY scripts/entrypoint.sh /etc/nginx/scripts/entrypoint.sh
RUN chmod +x /etc/nginx/scripts/regen-config.sh /etc/nginx/scripts/entrypoint.sh

# Remove the default nginx config — entrypoint will generate the real one
RUN rm -f /etc/nginx/conf.d/default.conf

# Volume for trigger file (shared with backend container)
VOLUME ["/shared/nginx"]

# Override the default nginx entrypoint
ENTRYPOINT ["/etc/nginx/scripts/entrypoint.sh"]
