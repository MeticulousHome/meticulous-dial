import os
import time
import subprocess
import boto3
from botocore.exceptions import ClientError
import json

PROJECT_DIR ="/home/pi/actions-runner/_work/meticulous-ui/meticulous-ui/"
DEB_PATH = PROJECT_DIR + "out/make/deb/arm64"
LAST_UPDATE_PATH = "/home/pi/meticulous-ui-action/last_update.txt"
NPM_COMMAND = "package --arch=arm64 && tar -czvf ./out/{name} ./out/meticulous-ui-linux-arm64"
TAR_FILE = PROJECT_DIR + "out/{name}"

deb = os.listdir(DEB_PATH)
last_deb_created = os.path.getmtime(DEB_PATH + "/" + deb[0])


with open(LAST_UPDATE_PATH, "r") as r_file:
    data = r_file.readlines()

if str(last_deb_created) != data[0].strip():

    f_package = open(PROJECT_DIR + "package.json")
    j_data = json.load(f_package)
    m_version = j_data['version']
    f_package.close()

    m_file_name = 'meticulous-' + m_version + '.tar.gz'

    d = subprocess.Popen("rm -rf " + TAR_FILE, stdout=subprocess.PIPE, shell=True)
    d.communicate()

    print("Creating tar.gz file...")

    p = subprocess.Popen("cd " + PROJECT_DIR + " && npm run " + NPM_COMMAND.replace('{name}', m_file_name), stdout=subprocess.PIPE, shell=True)
    p.communicate()
    time.sleep(1)

    if os.path.isfile(TAR_FILE.replace('{name}', m_file_name)):
        print("Uploading...")
        s3_client = boto3.client('s3')
        try:
            if "beta" in m_file_name:
                branch = "beta"
            if "alpha" in m_file_name:
                branch = "alpha"
            if "master" in m_file_name:
                branch = "master"

            response = s3_client.upload_file(TAR_FILE.replace('{name}', m_file_name), 'meticulous-dist', 'dial-app/' + branch + "/" + m_file_name)
            print("The file " + m_file_name + " was upload to S3 :)")
        except ClientError as e:
            print(e)

    with open(LAST_UPDATE_PATH, "w") as w_file:
        w_file.write(str(last_deb_created))
else:
    print("The file not as update yet")