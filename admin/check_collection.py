import pymongo
import re
import numpy
import datetime
import argparse
import json
import sys
import os.path as osp
from pprint import pprint
import random
random.seed(8)

def main(params):

    output_txt = params['output_txt']
    dataset = params['dataset']
    splitBy = params['splitBy']
    split   = params['split']

    # load refer
    sys.path.insert(0, 'refer')
    from refer import REFER
    refer = REFER('data', dataset, splitBy)

    # get refs that within the indicate split
    refs = []
    for ref_id, ref in refer.Refs.items():
        if split in ref['split']:
            # as long as ref['split'] contains string of split, e.g., testA or testB (contains 'test')
            refs += [ref]
    fn_to_ref = {ref['file_name']: ref['ref_id'] for ref in refs}

    # load mongodb collection
    client = pymongo.MongoClient()
    collection = client['sessions_coco']['Games']
    entries = collection.find({
        "timeStamp": {
            #"$gt": datetime.datetime(2016, 10, 19, 0, 0, 0, 0)
            "$gt": datetime.datetime(2016, 11, 1, 0, 0, 0, 0)
            }
        })

    ref_to_entry = {ref['ref_id']: [] for ref in refs}
    for entry in entries:
        if entry['accuracy'] == 'Correct!':
            file_name = entry['imageNumber']
            ref_id = fn_to_ref[file_name]
            ref_to_entry[ref_id] += [entry['expression']]

    # check number of collection
    done = 0
    num_want = 10
    ref_to_todo = {}
    for ref in refs:
        num_old = len(ref['sentences'])
        num_new = len(ref_to_entry[ref['ref_id']])
        if num_old + num_new >= num_want:
            done += 1
            print 'ref_id[%s] done. (%s/%s)' % (ref['ref_id'], done, len(refs))
        else:
            ref_to_todo[ref['ref_id']] = num_want - num_old - num_new

    # on average how many expressions do we miss
    mean_missing = sum(ref_to_todo.values())*1.0/len(ref_to_todo)
    print 'On average, we miss %s (out of 10) expressions for each of the left %s refs' % (mean_missing, len(ref_to_todo))

    # write to output_txt
    if params['write_output'] > 0:
        file_names = []
        for ref_id, todo in ref_to_todo.items():
            for i in range(todo):
                file_names.append(refer.Refs[ref_id]['file_name'])
        random.shuffle(file_names)

        txt_file = open(output_txt, 'w')
        for fn in file_names:
            txt_file.write(fn+'\n')
        txt_file.close()
        print '%s file_names for %s refs written in %s.' % (len(file_names), len(ref_to_todo), output_txt)

if __name__ == '__main__':

    parser = argparse.ArgumentParser()
    # input json
    parser.add_argument('--output_txt', default='../NewestOrder.txt', help='output txt file for objects to be collected')
    parser.add_argument('--dataset', default='refcoco', help='refcoco/refcoco+')
    parser.add_argument('--splitBy', default='unc', help='unc/google/berkeley')
    parser.add_argument('--split', default='test', help='we will consider all splits that contain this string, e.g., test -> testA & testB')
    parser.add_argument('--write_output', default=-1, help='if we want to write output_txt file.')
    # argparse
    args = parser.parse_args()
    params = vars(args)
    print 'parsed input parameters: '
    print json.dumps(params, indent=2)

    # call main
    main(params)

