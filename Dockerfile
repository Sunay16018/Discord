FROM php:8.2-apache

# Sistem güncellemeleri ve gerekli izinler
RUN apt-get update && apt-get upgrade -y
RUN a2enmod rewrite

# Dosyaları kopyala
COPY . /var/www/html/

# SQLite veritabanı için yazma izni ver (Çok Önemli)
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html

EXPOSE 80
